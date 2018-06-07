## Cleaning up after the demo

This demo uses multiple billed resources on [Google Cloud Platform](https://cloud.google.com/products/). The following sections give high level information on the corresponding pricing, and instructions on how to delete all the billed resources once finished with the demo.

### Billed resources

Running the demo costs approximately $0.12 per hour. Here are the cost components:
- Kubernetes Engine clusters are billed only for their nodes. See pricing details [here](https://cloud.google.com/kubernetes-engine/pricing). A cluster composed of two `n1-standard-1` nodes costs $0.095 per hour;
- The global HTTP load balancer is billed for the corresponding forwarding rules. See pricing details [here](https://cloud.google.com/compute/pricing). The first five forwarding rules cost $0.025 per hour. In addition, egress traffic is billed at the rates specified [here](https://cloud.google.com/compute/pricing#internet_egress), but this cost should be negligible for the demo;
- The persistent disk used for InfluxDB is billed depending on size and speed. See pricing details [here](https://cloud.google.com/compute/pricing). A standard 20GB disk costs $0.8 per month;
- Google Cloud Storage pricing and Google Key Management Service pricing are specified [here](https://cloud.google.com/storage/pricing) and [here](https://cloud.google.com/kms/pricing), respectively. The corresponding costs should be negligible for the demo.

You should be ready to incur in a $3 charge to your account if you want to collect temperature data for one full day.

### Revoking the Nest access token

OAuth access tokens for the Nest APIs have long term validity. During the demo you have acquired one token, which has been saved in the storage bucket you created for this purpose.

It is a good practice to revoke the access token before deleting it. The WebGUI includes a button through which you can order the revocation.

### Deleting all billed resources

The simplest way to get rid of all the billed resources is to delete the entire Google Cloud Platform project using the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/projects/delete) command.

```
gcloud projects delete [PROJECT_ID]
```

However, this approach may not be feasible if you have opted to run the demo in a project shared with other activities.

Go through the following steps if you want to get rid of all the billed resources without deleting the project.

**Delete the Kubernetes Engine cluster**

Use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/container/clusters/delete) command to delete the Kubernetes cluster.

```
gcloud container clusters delete [CLUSTER_NAME]
```

This single command has the effect to release all the cluster nodes, and delete all the deployments, services, forwarding rules, secrets, config maps and persistent volumes associated with the cluster.

**Release the static IP address used for the WebGUI**

Use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/compute/addresses/delete) command to release the static IP address used for the WebGUI.

```
gcloud compute addresses delete myhome-webgui --global
```

> If you had configured a domain name for the address, you may also want to reconfigure or delete the corresponding DNS A record.

**Delete the storage buckets**

For this demo you have created two storage buckets, one to hold the static files of the WebGUI and one to hold the access token for the Nest APIs. Use the following [gsutil](https://cloud.google.com/storage/docs/gsutil) command twice to delete both buckets:

```
gsutil rm [BUCKET_NAME]
```

**Deactivate managed keys**

Use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/kms/keys/versions/) commands...

```
gcloud kms keys versions list --key=KEY --keyring=KEYRING --location=global


gcloud kms keys versions destroy VERSION --key=KEY --keyring=KEYRING --location=global 
```

**Remove the images from the container registry**

Text

**Delete the service account used by the Data Collector**

Use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/iam/service-accounts/delete) command to delete the service account used by the Data Collector.

```
gcloud iam service-accounts delete myhome-collector@[PROJECT_ID].iam.gserviceaccount.com
```

This concludes all the operations. Go back to the [initial page](../README.md) in case you have changed mind and you want to bring-up the demo again.
