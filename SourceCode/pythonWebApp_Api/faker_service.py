from flask import jsonify
from faker import Faker
import json
import os
import json

faker = Faker()

class FakerService:

    def get_customers(self):
        customer_data = [
            {'firstName': faker.first_name(), 'lastName' : faker.last_name(), 'email' : faker.email(), 'address': faker.street_address(), 'city': faker.city(), 'state': faker.state(), 'zip': faker.postcode()  }
        ]
        #SendToKinesis Here
        return customer_data


