from flask import Flask, request, jsonify, render_template
from task_service import TaskService
from faker_service import FakerService
import json
import os

app = Flask(__name__)
taskService = TaskService();
fakerService = FakerService(); 

@app.route('/')
def home():
    return render_template('index.html')

## Health Check API ######
@app.route('/health')
def health_check():
    return "Healthy"
######################################################
## Faker APIs #############
@app.route('/api/customer')
def customer():
    return jsonify(fakerService.get_customers())


########################################################
## Task APIs ###########################
@app.route('/api/tasks')
def tasks():
    return taskService.get_tasks()

@app.route('/api/task', methods=['POST'])
def create_task():
    request_data = request.get_json(force=True)
    print(request_data)
    task = request_data['task']
    return taskService.create_task(task)


@app.route('/api/task', methods=['PUT'])
def update_task():
    request_data = request.get_json()
    return taskService.update_task(request_data['task'])


@app.route('/api/task/<int:id>', methods=['DELETE'])
def delete_task(id):
    return taskService.delete_task(id)

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
