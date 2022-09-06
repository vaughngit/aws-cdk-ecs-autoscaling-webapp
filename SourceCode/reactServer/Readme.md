
Reference: 
    Deep Dive on Amazon ECS Cluster Auto Scaling: https://aws.amazon.com/blogs/containers/deep-dive-on-amazon-ecs-cluster-auto-scaling/
    How can I configure Amazon ECS Service Auto Scaling on Fargate: https://aws.amazon.com/premiumsupport/knowledge-center/ecs-fargate-service-auto-scaling/
    https://medium.com/bb-tutorials-and-thoughts/dockerizing-react-app-with-nodejs-backend-26352561b0b7


docker build -t react-node-image .      
docker run -it -p 3080:80 --rm --name react-node-ui react-node-image
docker stop react-node-image      
#docker rm react-node-ui 
