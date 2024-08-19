from flask import Flask, send_from_directory, render_template, request, redirect, url_for
from flask_login import LoginManager, UserMixin, login_user, login_required, current_user, logout_user
from models import db, User

app = Flask(__name__, static_folder='./static', template_folder='./templates')
app.secret_key = 'MD2i*OzXmjjRuwCR'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

@app.route('/')
@login_required
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        user = User.query.filter_by(username=username).first()
        if user and user.password == password:
            login_user(user)
            return redirect(url_for('index'))
        else:
            return 'Invalid credentials'

    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        new_user = create_user(username, password)
        login_user(new_user)
        return redirect(url_for('index'))

    return render_template('register.html')

def create_user(username, password):
    user = User(username=username, password=password)
    db.session.add(user)
    db.session.commit()
    return user

# Endpoint to serve JSON data
@app.route('/data/<path:filename>')
@login_required
def data(filename):
    return send_from_directory('data', filename)

def create_user(username, password):
    user = User(username=username, password=password)
    db.session.add(user)
    db.session.commit()
    return user

@app.route('/models/<path:path>')
def serve_models(path):
    return send_from_directory('models', path)

#@app.route('/user-config', methods=['GET', 'POST'])
#@login_required
#def user_config():
#    if request.method == 'POST':
#        user_id = request.form.get('user_id')
#        user = User.query.get(user_id)
#        if user:
#            db.session.delete(user)
#            db.session.commit()
#    users = User.query.all()
#    return render_template('user_config.html', users=users)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0' ,debug=True)

