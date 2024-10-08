function init(data) {
    // Set up the scene, camera, and renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Add orbit controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);

    // Create a map to store the nodes by their IDs for easy access
    const nodes = new Map();
    const draggableObjects = [];
    const edges = new Map(); 
    const labels = new Map();

    // Function to generate random position around a parent node
    function getRandomPositionAroundParent(parentPosition, radius) {
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * radius;
        const x = parentPosition.x + Math.cos(angle) * distance;
        const y = parentPosition.y + Math.sin(angle) * distance;
        const z = parentPosition.z; // Assuming a 2D plane
        return new THREE.Vector3(x, y, z);
    }

    // Function to create a label sprite
    function createLabel(text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = '24px Arial';
        context.fillStyle = 'white';
        context.fillText(text, 0, 24);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(4, 2, 1); // Adjust size as necessary
        return sprite;
    }

    // Parse data and create nodes
    data.nodes.forEach(node => {
        let geometry;
        const material = new THREE.MeshBasicMaterial({ color: 0x2C997F });

        if (node.shape === 'cube') {
            geometry = new THREE.BoxGeometry(1, 1, 1);
        } else if (node.shape === 'sphere') {
            geometry = new THREE.SphereGeometry(0.5, 32, 32);
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(node.position.x, node.position.y, node.position.z);
        mesh.name = node.name;
        mesh.userData = { isCollapsed: false }; // Track if node is collapsed

        // Create and add label
        const label = createLabel(node.name);
        label.position.set(node.position.x, node.position.y + 1.5, node.position.z); // Position above the node
        scene.add(label);
        labels.set(node.id, label);
        console.log(`Label created for node: ${node.name} with ID: ${node.id}`);

        scene.add(mesh);
        nodes.set(node.id, mesh);
        draggableObjects.push(mesh);

        // Add parent reference if available
        if (node.parent) {
            const parent = nodes.get(node.parent);
            if (parent) {
                if (!parent.children) {
                    parent.children = [];
                }
                parent.children.push(mesh);
                console.log(`Added ${node.name} as child of ${parent.name}`);
            } else {
                console.warn(`Parent with ID ${node.parent} not found for node ${node.name}`);
            }
        }
    });

    // Create edges between nodes
    data.edges.forEach(edge => {
        const sourceNode = nodes.get(edge.source);
        const targetNode = nodes.get(edge.target);

        if (sourceNode && targetNode) {
            const material = new THREE.LineBasicMaterial({ color: 0xffffff });
            const points = [
                new THREE.Vector3(sourceNode.position.x, sourceNode.position.y, sourceNode.position.z),
                new THREE.Vector3(targetNode.position.x, targetNode.position.y, targetNode.position.z)
            ];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);
            line.userData = { sourceNode, targetNode, length: sourceNode.position.distanceTo(targetNode.position) };
            scene.add(line);

            if (!edges.has(sourceNode.id)) {
                edges.set(sourceNode.id, []);
            }
            edges.get(sourceNode.id).push(line);

            if (!edges.has(targetNode.id)) {
                edges.set(targetNode.id, []);
            }
            edges.get(targetNode.id).push(line);
        } else {
            console.warn(`Edge source or target node not found: ${edge.source} -> ${edge.target}`);
        }
    });

    // Position the camera
    camera.position.z = 20;

    // Add drag controls
    const dragControls = new THREE.DragControls(draggableObjects, camera, renderer.domElement);
    dragControls.addEventListener('dragstart', function (event) {
        controls.enabled = false;
    });

    dragControls.addEventListener('dragend', function (event) {
        controls.enabled = true;
    });

    dragControls.addEventListener('drag', function (event) {
        const draggedNode = event.object;

        // Update edges positions
        edges.forEach(edgeList => {
            edgeList.forEach(line => {
                const { sourceNode, targetNode } = line.userData;
                const points = [
                    new THREE.Vector3(sourceNode.position.x, sourceNode.position.y, sourceNode.position.z),
                    new THREE.Vector3(targetNode.position.x, targetNode.position.y, targetNode.position.z)
                ];
                line.geometry.setFromPoints(points);
            });
        });

        // Update children positions based on default edge lengths
        if (draggedNode.children) {
            draggedNode.children.forEach(child => {
                const edge = edges.get(draggedNode.id).find(e => e.userData.sourceNode === draggedNode && e.userData.targetNode === child);
                if (edge) {
                    const direction = child.position.clone().sub(draggedNode.position).normalize();
                    const newPosition = draggedNode.position.clone().add(direction.multiplyScalar(edge.userData.length));
                    child.position.copy(newPosition);
                }
            });
        }

        // Update labels positions
        labels.forEach((label, id) => {
            const node = nodes.get(id);
            if (node) {
                label.position.set(node.position.x, node.position.y + 1.5, node.position.z);
            }
        });
    });

    // Add raycaster for detecting clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onMouseClick(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(draggableObjects);

        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            console.log(`Node clicked: ${intersectedObject.name}`);
            toggleChildren(intersectedObject);
            bounceNode(intersectedObject, edges.get(intersectedObject.id) || []);
        }
    }

    function toggleChildren(parent) {
        if (parent.children) {
            const isCollapsed = parent.userData.isCollapsed;
            const randomRadius = 0.1;

            const targetPositions = [];
            const initialPositions = [];

            parent.children.forEach(child => {
                const label = labels.get(child.id);
                if (isCollapsed) {
                    // Opening effect: Move children back to their initial positions
                    targetPositions.push(child.userData.originalPosition.clone());
                    initialPositions.push(child.position.clone());
                    // Show edges connected to this child
                    updateEdgeVisibility(child, true);
                } else {
                    // Closing effect: Move children to random positions
                    targetPositions.push(getRandomPositionAroundParent(parent.position, randomRadius));
                    initialPositions.push(child.position.clone());
                    // Hide edges connected to this child with fade-out effect
                    fadeOutEdges(child, 500);
                }
            });

            parent.children.forEach((child, index) => {
                const tween = new TWEEN.Tween(child.position)
                    .to(targetPositions[index], 1000)  // Animation duration in ms
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .onUpdate(() => {
                        // Update edges during the animation
                        edges.forEach(edgeList => {
                            edgeList.forEach(line => {
                                const { sourceNode, targetNode } = line.userData;
                                if ((sourceNode === child) || (targetNode === child)) {
                                    const points = [
                                        new THREE.Vector3(sourceNode.position.x, sourceNode.position.y, sourceNode.position.z),
                                        new THREE.Vector3(targetNode.position.x, targetNode.position.y, targetNode.position.z)
                                    ];
                                    line.geometry.setFromPoints(points);
                                }
                            });
                        });

                        // Update labels positions and visibility
                        labels.forEach((label, id) => {
                            const node = nodes.get(id);
                            if (node) {
                                label.position.set(node.position.x, node.position.y + 1.5, node.position.z);
                                label.visible = node.visible; // Update label visibility based on node visibility
                            }
                        });
                    })
                    .onComplete(() => {
                        if (isCollapsed) {
                            child.visible = true;
                        } else {
                            child.visible = false;
                        }
                    })
                    .start();
            });

            if (!isCollapsed) {
                parent.children.forEach(child => {
                    child.userData.originalPosition = child.position.clone();
                    child.visible = true;
                });
            }

            parent.userData.isCollapsed = !isCollapsed;

            function animate() {
                requestAnimationFrame(animate);
                TWEEN.update();
            }
            animate();
        }
    }

    function bounceNode(node, edges) {
        const originalPosition = node.position.clone();
        const targetPosition = originalPosition.clone().add(new THREE.Vector3(0, 1, 0)); // Bounce up by 1 unit

        new TWEEN.Tween(node.position)
            .to(targetPosition, 200) // Animation duration in ms
            .easing(TWEEN.Easing.Quadratic.Out)
            .yoyo(true) // Reverse the animation after it completes
            .repeat(1) // Number of times to repeat the animation
            .onUpdate(() => {
                // Update the positions of the edges connected to the node
                edges.forEach(edge => {
                    const { sourceNode, targetNode } = edge.userData;
                    const points = [
                        new THREE.Vector3(sourceNode.position.x, sourceNode.position.y, sourceNode.position.z),
                        new THREE.Vector3(targetNode.position.x, targetNode.position.y, targetNode.position.z)
                    ];
                    edge.geometry.setFromPoints(points);
                });
            })
            .start();
    }

    function updateEdgeVisibility(node, visible) {
        if (edges.has(node.id)) {
            edges.get(node.id).forEach(line => {
                line.visible = visible;
            });
        }
    }

    function fadeOutEdges(node, duration) {
        if (edges.has(node.id)) {
            edges.get(node.id).forEach(line => {
                new TWEEN.Tween(line.material)
                    .to({ opacity: 0 }, duration)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .onUpdate(() => {
                        line.material.opacity = line.material.opacity;
                    })
                    .onComplete(() => {
                        line.visible = false;
                    })
                    .start();
            });
        }
    }

    window.addEventListener('click', onMouseClick, false);

    // Render loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }

    animate();
}
