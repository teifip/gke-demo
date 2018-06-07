## Protect the WebGUI with Google Sign-In

This section illustrates how to configure the WebGUI application to use [Google Sign-In](https://developers.google.com/identity/sign-in/web/) for access control.

### Create the Google Sign-In OAuth client

First of all you need to create a Google Sign-In OAuth client for the WebGUI. You can start the process from the Credentials section of the APIs & Services [console](https://console.cloud.google.com/apis/credentials).  

The new OAuth client can be created within the same project you have used for the Kubernetes Engine cluster or within a different project. The following table shows the key configuration parameters.

| Parameter                     | Value           |
|:------------------------------|:----------------|
| Product name shown to users   | `MyHome WebGUI` or whatever other name you prefer  |
| Application type              | `Web application` |
| Authorized JavaScript origins | `https://[static_IP_or_domain_name]` with either the static IP address you have allocated for the WebGUI or the domain name you have associated with it |

Once you have created the new OAuth client, take note of its Client ID.

### Prepare the configuration for the WebGUI application

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to store the Client ID of the newly created OAuth client and one or more Gmail addresses in a Kubernetes [secret](https://cloud.google.com/kubernetes-engine/docs/concepts/secret) with name equal to `webgui-login`.

```
kubectl create secret generic webgui-login \
   --from-literal WEBGUI_LOGIN_CLIENT_ID=[CLIENT_ID] \
   --from-literal WEBGUI_LOGIN_AUTHORIZED_USERS=[GMAIL_ADDRESSES]
   --from-literal WEBGUI_LOGIN_COOKIE_SECRET=[CUSTOM_PASSPHRASE]
```

The Gmail address you specify here must be the one you intend to use to access the WebGUI. If you want to specify multiple Gmail addresses, just enter them as a comma separated list.

The WebGUI application uses signed cookies to keep track of sessions. The passphrase used to sign cookies must be specified with the `webgui-login` secret.

### Restart the WebGUI application

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) commands to identify the WebGUI pod and delete it.

```
kubectl get pod

kubectl delete pod [WEBGUI_POD_NAME]
```

The WebGUI [deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) takes care of starting a new WebGUI pod to replace the one you have deleted. The new pod finds the `webgui-login` secret and takes it as an indication that access control should be enforced.

Wait until the new pod is up and running, and then access again the WebGUI. This time you will be directed to use Google Sign-In. You will be able to move on to the WebGUI only if you sign-in with one of the Gmail accounts you have stored in the `webgui-login` secret.

Continue to the [next step](./ddos.md).
