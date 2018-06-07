## Cleaning up after the demo

This demo uses multiple billed resources on [Google Cloud Platform](https://cloud.google.com/products/). The following sections give high level information on the corresponding pricing, and instructions on how to delete all the billed resources once finished with the demo.

### Billed resources

Running the demo costs approximately $0.12 per hour. Here are the cost components:
- Kubernetes Engine clusters are billed only for their nodes. See pricing details [here](https://cloud.google.com/kubernetes-engine/pricing). A cluster composed of two `n1-standard-1` nodes costs $0.095 per hour;
- The global HTTP load balancer is billed for the corresponding forwarding rules. See pricing details [here](https://cloud.google.com/compute/pricing). The first five forwarding rules cost $0.025 per hour. In addition, egress traffic is billed at the rates specified [here](https://cloud.google.com/compute/pricing#internet_egress), but this cost should be negligible for the demo;
- The persistent disk used for InfluxDB is billed depending on size and speed. See pricing details [here](https://cloud.google.com/compute/pricing). A standard 20GB disk costs $0.8 per month;
- Google Cloud Storage pricing and Google Key Management Service pricing are specified [here](https://cloud.google.com/storage/pricing) and [here](https://cloud.google.com/kms/pricing), respectively. The corresponding costs should be negligible for the demo.

If you want to collect temperature data for one full day, you should be ready to incur in a $3 charge to your account.

### Deleting all billed resources

To be prepared
