package main

import (
	"context"
	"log"

	"github.com/Phala-Network/phala-cloud/terraform/internal/provider"
	"github.com/hashicorp/terraform-plugin-framework/providerserver"
)

var version = "dev"

func main() {
	err := providerserver.Serve(context.Background(), provider.New(version), providerserver.ServeOpts{
		Address: "registry.terraform.io/phala-network/phala",
	})
	if err != nil {
		log.Fatal(err)
	}
}
