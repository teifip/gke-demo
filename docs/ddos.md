## Configure Cloud Armor for DDoS protection

The [global HTTP load balancer](https://cloud.google.com/compute/docs/load-balancing/http/) we have configured as [ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) for the WebGUI has built-in protection for network and transport level attacks such as SYN floods, IP fragment floods, and port exhaustion. In addition, the load balancer can be configured with [Cloud Armor](https://cloud.google.com/armor/) policies to implement service specific defenses such as whitelisting/blacklisting of IP addresses or of geographical areas.

This section illustrates how to create a Cloud Armor policy and attach it to the WebGUI ingress.

### Create a Cloud Armor policy

Use of policies other than simple IP white/black lists is currently restricted to customers with access to Cloud Armor alpha features. Therefore, this example implements a trivial IP address whitelisting policy. The example will be updated as soon as access to more advanced features becomes unrestricted.

Use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/beta/compute/security-policies/create) command to create a security policy.

```
gcloud beta compute security-policies create myhome-webgui \
   --description="Allow only whitelisted source addresses"
```

By default the security policy is created with an _allow all_ default rule at the lowest `2147483647` priority. Use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/beta/compute/security-policies/rules/update) command to change it into a _block all_ default rule.

```
gcloud beta compute security-policies rules update 2147483647 \
   --security-policy=myhome-webgui --action=deny-403
```

Then, use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/beta/compute/security-policies/rules/create) command to specify the IP addresses to be whitelisted.

```
gcloud beta compute security-policies rules create 1000 \
   --security-policy myhome-webgui \
   --description="Allow traffic from home and office" \
   --action="allow" \
   --src-ip-ranges=[HOME_CIDR_BLOCK],[OFFICE_CIDR_BLOCK]
```

In the example above we have used priority `1000`, but any number lower than `2147483647` will have the same effect.

### Attach the policy to the cluster ingress

Use the following [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/) command to determine the name of the backend associated with the cluster ingress. The name of the backend is found in the Annotations section of the output and has the form `k8s-...`.

```
kubectl describe ingress webgui
```

Use the following [gcloud](https://cloud.google.com/sdk/gcloud/reference/beta/compute/backend-services/update) command to attach the newly created security policy to the backend.

```
gcloud beta compute backend-services update [BACKEND] \
    --security-policy myhome-webgui --global
```

At this point access to the WebGUI is restricted to the whitelisted IP addresses.

This concludes the demo. Refer to the [cleaning-up section](./cleaning.md) for information on how to delete all the billed resources.
