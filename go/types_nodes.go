package phala

// AvailableNodes is the response for listing available nodes.
type AvailableNodes struct {
	Tier            string            `json:"tier"`
	Capacity        ResourceThreshold `json:"capacity"`
	Nodes           []TeepodCapacity  `json:"nodes"`
	KMSList         []KMSInfo         `json:"kms_list"`
	GPUAvailability *GPUAvailability  `json:"gpu_availability,omitempty"`
}

// ResourceThreshold holds resource threshold limits.
type ResourceThreshold struct {
	MaxInstances *int `json:"max_instances,omitempty"`
	MaxVCPU      *int `json:"max_vcpu,omitempty"`
	MaxMemory    *int `json:"max_memory,omitempty"`
	MaxDisk      *int `json:"max_disk,omitempty"`
}

// TeepodCapacity represents a node's capacity.
type TeepodCapacity struct {
	TeepodID          int              `json:"teepod_id"`
	Name              string           `json:"name"`
	Listed            bool             `json:"listed"`
	ResourceScore     float64          `json:"resource_score"`
	RemainingVCPU     float64          `json:"remaining_vcpu"`
	RemainingMemory   float64          `json:"remaining_memory"`
	RemainingCVMSlots float64          `json:"remaining_cvm_slots"`
	Images            []AvailableImage `json:"images"`
	SupportOnchainKMS *bool            `json:"support_onchain_kms,omitempty"`
	FMSPC             *string          `json:"fmspc,omitempty"`
	DeviceID          *string          `json:"device_id,omitempty"`
	RegionIdentifier  *string          `json:"region_identifier,omitempty"`
	DefaultKMS        *string          `json:"default_kms,omitempty"`
	KMSList           []string         `json:"kms_list,omitempty"`
}

// AvailableImage represents an available OS image on a node.
type AvailableImage struct {
	Name        string  `json:"name"`
	IsDev       bool    `json:"is_dev"`
	Version     any     `json:"version"`
	OSImageHash *string `json:"os_image_hash,omitempty"`
}

// GPUAvailability describes GPU access for the current workspace.
type GPUAvailability struct {
	HasReservedGPUs  bool `json:"has_reserved_gpus"`
	ReservedGPUCount int  `json:"reserved_gpu_count"`
	HasPublicGPUs    bool `json:"has_public_gpus"`
	PublicGPUCount   int  `json:"public_gpu_count"`
}

// CVMCreateResources is the resource graph for CVM creation.
type CVMCreateResources struct {
	Tier             string                     `json:"tier"`
	Capacity         ResourceThreshold          `json:"capacity"`
	Nodes            []TeepodCapacity           `json:"nodes"`
	KMSNodes         []CVMCreateKMSResource     `json:"kms_nodes"`
	NodeKMSRelations []CVMCreateNodeKMSRelation `json:"node_kms_relations"`
	GatewayNodes     []CVMCreateGatewayResource `json:"gateway_nodes"`
	InstanceTypes    []CVMCreateInstanceType    `json:"instance_types"`
	GPUAvailability  GPUAvailability            `json:"gpu_availability"`
}

// CVMCreateKMSResource is a KMS candidate in the CVM creation graph.
type CVMCreateKMSResource struct {
	ID                 StringOrNumber `json:"id"`
	Slug               *string        `json:"slug,omitempty"`
	URL                string         `json:"url"`
	Version            *string        `json:"version,omitempty"`
	KMSType            string         `json:"kms_type"`
	ChainID            *int           `json:"chain_id,omitempty"`
	KMSContractID      *KMSContractID `json:"kms_contract_id,omitempty"`
	KMSContractAddress *string        `json:"kms_contract_address,omitempty"`
	GatewayAppID       *string        `json:"gateway_app_id,omitempty"`
	SupportedOSImages  []string       `json:"supported_os_images,omitempty"`
}

// CVMCreateNodeKMSRelation maps a teepod to one supported KMS resource.
type CVMCreateNodeKMSRelation struct {
	TeepodID           int            `json:"teepod_id"`
	KMSID              StringOrNumber `json:"kms_id"`
	KMSType            string         `json:"kms_type"`
	KMSContractID      *KMSContractID `json:"kms_contract_id,omitempty"`
	KMSContractAddress *string        `json:"kms_contract_address,omitempty"`
	SupportedOSImages  []string       `json:"supported_os_images,omitempty"`
}

// CVMCreateGatewayResource is a gateway candidate for a KMS contract.
type CVMCreateGatewayResource struct {
	ID            StringOrNumber `json:"id"`
	TeepodID      *int           `json:"teepod_id,omitempty"`
	KMSContractID KMSContractID  `json:"kms_contract_id"`
	RPCURL        *string        `json:"rpc_url,omitempty"`
	DomainSuffix  *string        `json:"domain_suffix,omitempty"`
	Enabled       bool           `json:"enabled"`
}

// CVMCreateInstanceType is an instance type candidate for CVM creation.
type CVMCreateInstanceType struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	VCPU              int     `json:"vcpu"`
	MemoryMB          int     `json:"memory_mb"`
	DefaultDiskSizeGB int     `json:"default_disk_size_gb"`
	RequiresGPU       bool    `json:"requires_gpu"`
	RequiresGPUCount  int     `json:"requires_gpu_count"`
	Family            *string `json:"family,omitempty"`
	DisplayOrder      *int    `json:"display_order,omitempty"`
}
