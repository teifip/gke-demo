## Deploy the WebGUI

The WebGUI application is written in [Node.js](https://nodejs.org/en/). All the code and its accompanying `Dockerfile` is in the `webgui` directory of this repository.

This section illustrates:
- The use of the Google [global HTTP load balancer](https://cloud.google.com/compute/docs/load-balancing/http/) as [ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/), with static IP address and with TLS enabled;
- The use of [secrets](https://kubernetes.io/docs/concepts/configuration/secret/) to store server certificates and private keys;
- The use of [Google Cloud Storage](https://cloud.google.com/storage/) to serve static web content.

### Reserve one static IP address

Use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/compute/addresses/) commands to allocate one static IP address with name equal to `myhome-webgui` and to retrieve the corresponding value.

```
gcloud compute addresses create myhome-webgui --global

gcloud compute addresses describe myhome-webgui --global
```

If you have a domain name available, update the corresponding DNS A record to point to the static IP address just allocated.

### Configure the server certificate and key

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to store the server certificate and private key in a Kubernetes [secret](https://cloud.google.com/kubernetes-engine/docs/concepts/secret) with name equal to `webgui-tls`.

```
kubectl create secret tls webgui-tls \
   --cert=[path_to_cert_file]
   --key=[path_to_key_file]
```

Both the certificate and the key must be in PEM format. You may use a self-signed certificate, but this will cause the browser to present a warning when you access the WebGUI.

If you have configured a domain name for the WebGUI, the certificate must be valid for that domain name.

### Build the image

Use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/container/builds/submit) command to build the image of the WebGUI application and push it to the [Google Container Registry](https://cloud.google.com/container-registry/) for your project.

```
gcloud container builds submit -t gcr.io/[PROJECT_ID]/webgui:1.0.0 ./webgui
```

The deployment manifest we will use later assumes that the image is tagged as `latest`. Therefore, use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/container/images/add-tag) command to add the `latest` tag to the image.

```
gcloud container images add-tag \
   gcr.io/[PROJECT_ID]/webgui:1.0.0 \
   gcr.io/[PROJECT_ID]/webgui:latest
```

### Load the static content to Google Cloud Storage

The only static content part of the WebGUI is a tiny `webgui.css` style file. Nevertheless, we want to demo how to serve it through [Google Cloud Storage](https://cloud.google.com/storage/) and take advantage of the corresponding CDN capabilities.

Use the following [gsutil](https://cloud.google.com/storage/docs/gsutil) commands to create a new storage bucket and make it publicly readable.

```
gsutil mb gs://[BUCKET_NAME]

gsutil defacl set public-read gs://[BUCKET_NAME]
```

Use the following [gsutil](https://cloud.google.com/storage/docs/gsutil) command to load the entire WebGUI static content to the `/assets` directory of the new bucket.

```
gsutil -m rsync -r ./webgui/static gs://[BUCKET_NAME]/assets
```

### Configure access to the static content

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to store the name of the newly created storage bucket in a Kubernetes [config map](https://cloud.google.com/kubernetes-engine/docs/concepts/configmap) with name equal to `webgui-config`. The config map will be used to set the value of the `WEBGUI_GS_BUCKET` environment variable for the WebGUI container.

```
kubectl create configmap webgui-config --from-literal WEBGUI_GS_BUCKET=[BUCKET_NAME]
```

### Configure Grafana credentials

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to store the credentials that will be used to access Grafana in a Kubernetes [secret](https://cloud.google.com/kubernetes-engine/docs/concepts/secret) with name equal to `grafana-credentials`.

```
kubectl create secret generic grafana-credentials \
   --from-literal GF_SECURITY_ADMIN_USER=admin \
   --from-literal GF_SECURITY_ADMIN_PASSWORD=[CUSTOM_PASSWORD]
```

### Deploy and expose the WebGUI

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to create the `webgui` deployment (single replica), service (NodePort) and ingress (HTTP load balancer).

```
kubectl apply -f ./manifests/webgui.yaml
```

The container specification in the `webgui.yaml` manifest references a `webgui-login` secret that we have not created yet. Nevertheless, the container can start since the reference is tagged as optional. We will create the `webgui-login` secret later when we will protect the WebGUI with [Google Sign-In](https://developers.google.com/identity/sign-in/web/).

Configuration of the global HTTP load balancer may take several minutes. You may follow the corresponding progress on the Kubernetes Engine [console](https://console.cloud.google.com/kubernetes).

Once the ingress is up, point your browser to the WebGUI:

```
https://[static_IP_or_domain_name]/webgui
```

Access via HTTP is redirected to HTTPS.

> You may want to visualize the WebGUI page source in your browser and double-check that the `webgui.css` file is effectively served from Google Cloud Storage rather than from the WebGUI application.

At this point the WebGUI just informs you that the Data Collector is not responding. Move to the [next step](./collector.md) to bring it up.
