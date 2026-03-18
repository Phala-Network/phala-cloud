package phala

// KMSInfo represents KMS server information.
type KMSInfo struct {
	ID                 string  `json:"id"`
	Slug               *string `json:"slug,omitempty"`
	URL                string  `json:"url"`
	Version            string  `json:"version"`
	ChainID            *int    `json:"chain_id,omitempty"`
	KMSContractAddress *string `json:"kms_contract_address,omitempty"`
	GatewayAppID       *string `json:"gateway_app_id,omitempty"`
}

// GetKMSListResponse is the paginated list of KMS servers.
type GetKMSListResponse = Paginated[KMSInfo]

// NextAppIDsResponse is the response for getting next app IDs.
type NextAppIDsResponse = GenericObject

// AppEnvPubKeyResponse is the response for getting app env encryption public key.
type AppEnvPubKeyResponse = GenericObject

// KMSOnChainDetail represents KMS on-chain detail.
type KMSOnChainDetail struct {
	ChainName string               `json:"chain_name"`
	ChainID   int                  `json:"chain_id"`
	Contracts []OnChainKMSContract `json:"contracts,omitempty"`
}

// OnChainKMSContract represents an on-chain KMS contract.
type OnChainKMSContract struct {
	ContractAddress string           `json:"contract_address"`
	ChainID         int              `json:"chain_id"`
	ChainName       string           `json:"chain_name"`
	Devices         []OnChainDevice  `json:"devices,omitempty"`
	OSImages        []OnChainOSImage `json:"os_images,omitempty"`
}

// OnChainDevice represents an on-chain device.
type OnChainDevice struct {
	DeviceID       string  `json:"device_id"`
	NodeName       *string `json:"node_name,omitempty"`
	OnChainAllowed *bool   `json:"on_chain_allowed,omitempty"`
}

// OnChainOSImage represents an on-chain OS image.
type OnChainOSImage struct {
	Name           string  `json:"name"`
	Version        string  `json:"version"`
	OSImageHash    *string `json:"os_image_hash,omitempty"`
	OnChainAllowed *bool   `json:"on_chain_allowed,omitempty"`
}
