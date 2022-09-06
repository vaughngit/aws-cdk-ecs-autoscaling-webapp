# flask-docker


# Test locally: 

## build the image
docker build -t flask-webapi .

## list the image
docker images

## run the container
docker run -d -p 5000:5000 --rm --name python-webapi flask-webapi 

## list the container
docker ps

## logs
docker logs python-webapi

## exec into running container
docker exec -it python-restapi /bin/sh

## kill/stop container
docker stop python-webapi


### Resources: 
    Faker documentation: https://faker.readthedocs.io/en/master/ 
    Flask Docker Template: https://github.com/olu-damilare/flask-docker 