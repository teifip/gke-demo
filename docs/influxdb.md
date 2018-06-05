## Deploy InfluxDB

InfluxDB is available as Docker image on [Docker Hub](https://hub.docker.com/_/influxdb/).

The community version of InfluxDB does not support clustering. Therefore, this demo uses a deployment with one single replica and one [persistent volume](https://cloud.google.com/kubernetes-engine/docs/concepts/persistent-volumes) (backed by a Google Compute Engine [persistent disk](https://cloud.google.com/persistent-disk/)).

Using Kubernetes [deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) for stateful applications like databases is not a recommended practice. Even the case with one single replica has some drawbacks that are discussed below.

### Create a persistent volume claim

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to dynamically provision a persistent volume for InfluxDB.

```
kubectl apply -f ./manifests/influxdb-pvc.yaml
```

Note that the `influxdb-pvc.yaml` manifest directly requests the creation of a `PersistentVolumeClaim`, which automatically triggers Kubernetes to provision the corresponding persistent disk. In other words, we are skipping the creation of the `PersistentVolume` object.

The default `StorageClass` is used, which has [reclaim policy](https://kubernetes.io/docs/concepts/storage/storage-classes/#reclaim-policy) equal to `Delete`. This implies that the persistent disk will be released - and all its data lost - if you delete the persistent volume claim.

### Deploy and expose InfluxDB

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to create the `influxdb` deployment (single replica) and service (ClusterIP).

```
kubectl apply -f ./manifests/influxdb.yaml
```

Once the deployment is completed, the Data Collector can start to store data in InfluxDB. If not already done, this is the right moment to go the WebGUI and start the periodic data collection. Then, you can either move to the [next step](./grafana.md) or read the additional information provided below.

### Upgrade strategy

Note that the `influxdb.yaml` manifest specifies `Recreate` as upgrade strategy for the POD rather than leaving it to the `RollingUpdate` default value. This is needed because our deployment uses a `ReadWriteOnce` volume. Even if the deployment has one single replica, starting a rolling update would cause a second POD to be created before bringing down the first POD, and this would result in a deadlock. In particular, the second POD does not become available until it can mount the volume while the first POD does not shut down and release the volume until the second POD is available.

> In general, stateful applications like databases should be managed with [stateful sets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) rather than with [deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/). With stateful sets, each POD replica can have its own unique persistent volume claims.

### Using the InfluxDB CLI

In case you want to use the CLI for troubleshooting or simply to see the database content, you can use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) commands to identify the InfluxDB POD name and [get a shell](https://kubernetes.io/docs/tasks/debug-application-cluster/get-shell-running-container/) on the InfluxDB container:

```
kubectl get pod

kubectl exec -it [POD_NAME] -- /bin/bash
```

Once you have the shell, you can invoke `influx` to start the CLI.

Continue to the [next step](./grafana.md).
