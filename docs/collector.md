## Deploy the Data Collector

The Data Collector application is written in [Node.js](https://nodejs.org/en/). All the code and its accompanying `Dockerfile` are in the `collector` directory of this repository.

This section illustrates:
- The use of [service accounts](https://cloud.google.com/iam/docs/service-accounts) to control access to cloud services on a per pod basis;
- How to securely store access tokens in [Google Cloud Storage](https://cloud.google.com/storage/) using application layer encryption with encryption key from [Google Key Management Service](https://cloud.google.com/kms/).

### Create a storage bucket for the access token

OAuth access tokens for the Nest APIs have long term validity. Therefore, it is appropriate to save them in some permanent storage rather than just hold them in memory.

In this demo we will use a [Google Cloud Storage](https://cloud.google.com/storage/) bucket to store the Data Collector access token. Moreover, we will use a key from [Google Key Management Service](https://cloud.google.com/kms/) to encrypt/decrypt the token at application layer.

Use the following [gsutil](https://cloud.google.com/storage/docs/gsutil) commands to create a new storage bucket:

```
gsutil mb gs://[BUCKET_NAME]
```

Then, use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/kms/) commands to create a new keyring and a new key inside the new keyring:

```
gcloud kms keyrings create [KEYRING_NAME] --location global

gcloud kms keys create [KEY_NAME] --location global \
   --keyring [KEYRING_NAME] --purpose encryption
```

Finally, use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to store the name of the newly created storage bucket, keyring and key in a Kubernetes [config map](https://cloud.google.com/kubernetes-engine/docs/concepts/configmap) with name equal to `collector-config`.

```
kubectl create configmap collector-config \
   --from-literal COLLECTOR_GS_BUCKET=[BUCKET_NAME] \
   --from-literal COLLECTOR_KMS_KEYRING=[KEYRING_NAME] \
   --from-literal COLLECTOR_KMS_KEY=[KEY_NAME]
```

### Create a service account for the Data Collector

Use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/iam/service-accounts/create) command to create a new service account:

```
gcloud iam service-accounts create myhome-collector \
   --display-name="Service Account for MyHome Data Collector"
```

The resulting service account has identifier equal to:

`myhome-collector@[PROJECT_ID].iam.gserviceaccount.com`

You can retrieve the identifier with the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/iam/service-accounts/list) command:

```
gcloud iam service-accounts list
```

Use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/iam/service-accounts/keys/create) command to create a private key for the new service account:

```
gcloud iam service-accounts keys create ./key.json \
   --iam-account=myhome-collector@[PROJECT_ID].iam.gserviceaccount.com
```

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to store the service account key in a Kubernetes [secret](https://cloud.google.com/kubernetes-engine/docs/concepts/secret) with name equal to `collector-account`.

```
kubectl create secret generic collector-account \
   --from-file=./key.json
```

Delete the `key.json` file or move it to a secure place.  

### Assign roles to the new service account

We want to grant the new service account privileges to create, read and delete objects in the storage bucket created above. For this purpose, use the following [gsutil](https://cloud.google.com/storage/docs/gsutil) command:

```
gsutil iam ch serviceAccount:myhome-collector@[PROJECT_ID].iam.gserviceaccount.com:objectAdmin gs://[BUCKET_NAME]
```

We also want to grant the new service account privileges to use the new key to encrypt and decrypt data. For this purpose, use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/kms/keys/add-iam-policy-binding) command:

```
gcloud kms keys add-iam-policy-binding [KEY_NAME] \
   --member=serviceAccount:myhome-collector@[PROJECT_ID].iam.gserviceaccount.com \
   --role=roles/cloudkms.cryptoKeyEncrypterDecrypter \
   --keyring=[KEYRING_NAME] \
   --location=global
```

### Build the image

Use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/container/builds/submit) command to build the image of the Data Collector application and push it to the [Google Container Registry](https://cloud.google.com/container-registry/) for your project.

```
gcloud container builds submit -t gcr.io/[PROJECT_ID]/collector:1.0.0 ./collector
```

The deployment manifest we will use later assumes that the image is tagged as `latest`. Therefore, use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/container/images/add-tag) command to add the `latest` tag to the image.

```
gcloud container images add-tag \
   gcr.io/[PROJECT_ID]/collector:1.0.0 \
   gcr.io/[PROJECT_ID]/collector:latest
```

### Configure options

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to store the wanted data collection interval, data retention period and temperature scale - either `celisus` or `fahrenheit` - in a Kubernetes [config map](https://cloud.google.com/kubernetes-engine/docs/concepts/configmap) with name equal to `collector-options`.

```
kubectl create configmap collector-options \
   --from-literal COLLECTION_INTERVAL_MINUTES=30 \
   --from-literal DATA_RETENTION_DAYS=7 \
   --from-literal TEMPERATURE_SCALE=celsius
```

The Data Collector enforces a minimum data collection interval of 2 minutes and a minimum data retention period of 2 days.

> The [Nest REST APIs](https://developers.nest.com/documentation/cloud/rest-guide) used by the Data Collector are designed for infrequent access. Systems that require near real-time updates should use the [Nest REST Streaming APIs](https://developers.nest.com/documentation/cloud/rest-streaming-guide) instead.

The Data Collector does not enforce a maximum data retention period. However, please be aware that any use you make of the collected data is subject to the [Nest Developer Terms of Service](https://developers.nest.com/documentation/cloud/tos).

### Deploy and expose the Data Collector

With any text editor, open the `collector.yaml` file in the `manifests` directory and replace the single occurrence of `[PROJECT_ID]` with your project name. This is needed to point to the correct container registry.

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to create the `collector` deployment (single replica) and service (ClusterIP).

```
kubectl apply -f ./manifests/collector.yaml
```

Once the deployment is completed, you can direct your browser again to the WebGUI. This time you will be redirected to the Nest login and authorization page so that the Data Collector can acquire an access token.

From the WebGUI you may start the periodic collection of data. However, be aware that no data will be saved until you deploy InfluxDB through the [next step](./influxdb.md).
