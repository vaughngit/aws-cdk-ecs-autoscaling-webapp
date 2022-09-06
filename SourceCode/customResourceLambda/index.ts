import * as AWS from "aws-sdk";
import { IAMClient, DeleteRoleCommand, RemoveRoleFromInstanceProfileCommand, DetachRolePolicyCommand, GetInstanceProfileCommand } from "@aws-sdk/client-iam"; //sdk v3 lib 
import { EC2Client,  DescribeInstancesCommand, DescribeVpcEndpointsCommand, CreateTagsCommand } from "@aws-sdk/client-ec2";
import { CdkCustomResourceEvent,  CdkCustomResourceHandler,  CdkCustomResourceResponse} from "aws-lambda";
import { request } from "http";

const iamClient = new IAMClient({ region: process.env.REGION });
// a client can be shared by different commands.
const ec2Client = new EC2Client({ region: process.env.REGION });


// // Set the parameters.
// const params = {
//   RoleName: "ROLE_NAME"
// }

// const run = async () => {
//   try {
//       const data = await iamClient.send(new DeleteRoleCommand(params));
//       console.log("Success. Role deleted.", data);
//   } catch (err) {
//       console.log("Error", err);
//   }
// };

//const tagVPCEndpoints = async (properties) =>{
  const tagVPCEndpoints = async (event: CdkCustomResourceEvent): Promise<CdkCustomResourceResponse> => {  
   //const vpcId = properties.vpcId
   const vpcId = event.ResourceProperties["vpcId"];
   const tags = event.ResourceProperties["tags"];
   let endPointTags = [...tags]
   let endPoints = [] //create empty array 

  // console.log("vpcId: ", vpcId)
  // console.log("endpointTags: ", endPointTags)

   const describeEndPoints = new DescribeVpcEndpointsCommand({Filters: [{Name: "vpc-id", Values: [vpcId]}]})
 //  const describeEndPoints = new DescribeVpcEndpointsCommand({Filters: [{Name: "vpc-endpoint-type", Values: ["Interface"]}]})
  let result = await ec2Client.send(describeEndPoints)
   //console.log("res ", result)
  // console.log("vpcendpoints: ", result.VpcEndpoints)
   for(const vpce of result.VpcEndpoints){
     // console.log("vpcid", vpce.VpcEndpointId)
    //  console.log("serviceName", vpce.ServiceName)
    //  console.log("Type: ", vpce.VpcEndpointType)
      endPoints.push(vpce.VpcEndpointId)
   }
   try{
   const createTags = new CreateTagsCommand({Resources: [...endPoints], Tags: [...endPointTags]})
   const request = await ec2Client.send(createTags)
   return {
    PhysicalResourceId: request.$metadata.requestId,
    data: {
      status: request.$metadata.httpStatusCode
    }
   }
   }catch (error) {
    console.log("create Tags error: ", error)
  }
    
}



const deleteNatInstanceRole = async (event: CdkCustomResourceEvent): Promise<CdkCustomResourceResponse> => {
  const instances = event.ResourceProperties["natGateways"];
  //const apiStage: string = event.ResourceProperties["API_STAGE"];

  // if (typeof apiId !== "string" || typeof apiStage !== "string") {
  //   throw new Error('"API_ID" and "API_STAGE" is required');
  // }
  console.log(instances)

  let profileName 
  let roleName 

  for(const instance of instances){
    try{
      console.log(instance)
      console.log("Instance gatewayID", instance.gatewayId)
      let describeInstance = new DescribeInstancesCommand({InstanceIds: [instance.gatewayId]});
      let instanceData = await ec2Client.send(describeInstance);
      // console.log("profile data: ", instanceData.Reservations[0].Instances[0].IamInstanceProfile.Arn)
       let instanceProfileArn = instanceData.Reservations[0].Instances[0].IamInstanceProfile.Arn 
       //console.log("str parse", instancePf.split('/')[1])
       profileName = instanceProfileArn.split('/')[1]
       console.log("parsed: ", profileName)
 
      let getInstanceProfile = new GetInstanceProfileCommand({InstanceProfileName: profileName })
      let profileDetails = await iamClient.send(getInstanceProfile)
 
      console.log(profileDetails.InstanceProfile.Roles[0].RoleName)
      roleName = profileDetails.InstanceProfile.Roles[0].RoleName 
      let removeProfile = new RemoveRoleFromInstanceProfileCommand({InstanceProfileName: profileName, RoleName: roleName })
      const request = await iamClient.send(removeProfile)


    } catch (error) {
      console.log("remove profile error: ", error)
    }
  }
  
    try {

      console.log("Delete Role Try " )
        // let getPerms = new ListRolePoliciesCommand({RoleName: profileDetails.InstanceProfile.Roles[0].RoleName})
       // let getPerms = new ListRolePoliciesCommand({RoleName: roleName})
       // await iamClient.send(getPerms)
        // console.log("profile res", rolePerms.PolicyNames)
 
        let detachRolePolicy = new DetachRolePolicyCommand({PolicyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore", RoleName: roleName})
        await iamClient.send(detachRolePolicy)

        let deleteRole = new DeleteRoleCommand({RoleName: roleName})
       const request = await iamClient.send(deleteRole)    
      
      return {
        // PhysicalResourceId: roleName
         Data: {
          requestId: request.$metadata.requestId,
          requestStatus: request.$metadata.httpStatusCode,
         },
       }
    } catch (error) {
      console.log("remove role error: ", error)
    } finally {
      console.log("Completed role removal commands")
    }

};


export const handler: CdkCustomResourceHandler = async (event, context) => {
  console.log("event object: ",event);
  console.log("context object", context);

  switch (event.RequestType) {
    case "Create":
/*       const promise1: CdkCustomResourceResponse = new Promise((resolve) => {
        resolve("created");
        return promise1 
      });
      */
      return tagVPCEndpoints(event);(event);
    case "Update":
      return tagVPCEndpoints(event);

    case "Delete":
      // const promise3: CdkCustomResourceResponse = new Promise((resolve) => {
      //   resolve("ok");
      // });
      // return promise3;

     return deleteNatInstanceRole(event)
  }
};

