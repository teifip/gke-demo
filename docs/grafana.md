## Deploy Grafana

Grafana is available as Docker image on [Docker Hub](https://hub.docker.com/r/grafana/grafana/).

In this demo Grafana is exposed only inside the Kubernetes cluster. The WebGUI application acts as a proxy and retrieves [rendered panels](http://docs.grafana.org/reference/sharing/#direct-link-rendered-image) from Grafana for presentation to the user.

### Configure InfluxDB as data source

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to create a Kubernetes [config map](https://cloud.google.com/kubernetes-engine/docs/concepts/configmap) with name equal to `grafana-datasource`.

```
kubectl create configmap grafana-datasource --from-file ./grafana/datasource.yaml
```

We will use this config map to [provision](http://docs.grafana.org/administration/provisioning/#datasources) the InfluxDB database as data source in Grafana at start-up.

### Deploy and expose Grafana

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to create the `grafana` deployment (single replica) and service (ClusterIP).

```
kubectl apply -f ./manifests/influxdb.yaml
```

Once the deployment is completed, the demo is fully functional and you can start to visualize the measurements that have been collected and stored in InfluxDB. The diagrams will appear poorly meaningful until some significant number of data points is available.

At this point the WebGUI is accessible to anyone who knows or can guess its URL. This issue is addressed at the [next step](./login.md).  
