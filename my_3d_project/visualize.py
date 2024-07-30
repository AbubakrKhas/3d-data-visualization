import json
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import numpy as np

# Load JSON data
with open('data.json') as f:
    data = json.load(f)

nodes = data['nodes']
edges = data['edges']

# Prepare data for plotting
node_positions = {node['id']: (node['position']['x'], node['position']['y'], node['position']['z']) for node in nodes}

# Create a 3D plot
fig = plt.figure()
ax = fig.add_subplot(111, projection='3d')

# Function to draw different shapes
def draw_shape(ax, shape, position):
    x, y, z = position
    if shape == "cube":
        r = [-0.5, 0.5]
        X, Y, Z = np.meshgrid(r, r, r)
        ax.scatter(X + x, Y + y, Z + z, color='g', alpha=0.5)
    elif shape == "sphere":
        u = np.linspace(0, 2 * np.pi, 100)
        v = np.linspace(0, np.pi, 100)
        xs = 0.5 * np.outer(np.cos(u), np.sin(v)) + x
        ys = 0.5 * np.outer(np.sin(u), np.sin(v)) + y
        zs = 0.5 * np.outer(np.ones(np.size(u)), np.cos(v)) + z
        ax.plot_surface(xs, ys, zs, color='b', alpha=0.5)
    elif shape == "heart":
        t = np.linspace(0, 2 * np.pi, 100)
        x_heart = 16 * np.sin(t)**3
        y_heart = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
        ax.plot(x_heart + x, y_heart + y, zs=np.full_like(x_heart, z), color='r')

# Plot nodes
for node in nodes:
    position = node_positions[node['id']]
    draw_shape(ax, node['shape'], position)

# Plot edges
for edge in edges:
    source_pos = node_positions[edge['source']]
    target_pos = node_positions[edge['target']]
    ax.plot([source_pos[0], target_pos[0]], 
            [source_pos[1], target_pos[1]], 
            [source_pos[2], target_pos[2]], c='k')

# Setting labels and title
ax.set_xlabel('X Label')
ax.set_ylabel('Y Label')
ax.set_zlabel('Z Label')
ax.set_title('3D Graph Visualization')

plt.show()
