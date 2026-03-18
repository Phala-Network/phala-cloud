package phala

// AvailableNodes is the response for listing available nodes.
type AvailableNodes struct {
	Tier     string            `json:"tier"`
	Capacity ResourceThreshold `json:"capacity"`
	Nodes    []TeepodCapacity  `json:"nodes"`
	KMSList  []KMSInfo         `json:"kms_list"`
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
