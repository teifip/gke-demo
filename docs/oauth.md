## Create the Nest OAuth client

Login to your Nest [developer console](https://console.developers.nest.com/) and create a new OAuth client.

### OAuth client configuration

The only required permissions for this demo are the **Thermostat read** permissions.

Configure the **Default OAuth Redirect URI** to:

```
https://[static_IP_or_domain_name]/redirect
```

where `[static_IP_or_domain_name]` is the value configred for the WebGUI at the [previous step](./webgui.md).

Take note of the **Client ID** and **Client Secret** assigned to the new OAuth client.

### Securely store the OAuth client credentials

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to store the client credentials in a Kubernetes [secret](https://cloud.google.com/kubernetes-engine/docs/concepts/secret) with name equal to `nest-oauth`.

```
kubectl create secret generic nest-oauth \
   --from-literal OAUTH2_CLIENT_ID=[CLIENT_ID] \
   --from-literal OAUTH2_CLIENT_SECRET=[CLIENT_SECRET]
```

Move to the [next step](./collector.md) once done.
