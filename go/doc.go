// Package phala provides a Go client for the Phala Cloud API.
//
// Usage:
//
//	client, err := phala.NewClient(
//	    phala.WithAPIKey("your-api-key"),
//	)
//	if err != nil {
//	    log.Fatal(err)
//	}
//
//	user, err := client.GetCurrentUser(context.Background())
//	if err != nil {
//	    log.Fatal(err)
//	}
package phala
