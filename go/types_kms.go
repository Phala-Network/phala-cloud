package phala

import (
	"encoding/json"
	"fmt"
)

// StringOrNumber is a JSON value that can be either a string or an integer.
type StringOrNumber struct {
	stringValue *string
	intValue    *int
}

// NewStringOrNumberString creates a string value.
func NewStringOrNumberString(value string) *StringOrNumber {
	return &StringOrNumber{stringValue: &value}
}

// NewStringOrNumberInt creates an integer value.
func NewStringOrNumberInt(value int) *StringOrNumber {
	return &StringOrNumber{intValue: &value}
}

// StringValue returns the string value if present.
func (value StringOrNumber) StringValue() (string, bool) {
	if value.stringValue == nil {
		return "", false
	}
	return *value.stringValue, true
}

// IntValue returns the integer value if present.
func (value StringOrNumber) IntValue() (int, bool) {
	if value.intValue == nil {
		return 0, false
	}
	return *value.intValue, true
}

// String returns the value formatted as a string.
func (value StringOrNumber) String() string {
	if value.stringValue != nil {
		return *value.stringValue
	}
	if value.intValue != nil {
		return fmt.Sprintf("%d", *value.intValue)
	}
	return ""
}

// MarshalJSON encodes the original string or integer value.
func (value StringOrNumber) MarshalJSON() ([]byte, error) {
	if value.stringValue != nil {
		return json.Marshal(*value.stringValue)
	}
	if value.intValue != nil {
		return json.Marshal(*value.intValue)
	}
	return []byte("null"), nil
}

// UnmarshalJSON decodes a string or integer value.
func (value *StringOrNumber) UnmarshalJSON(data []byte) error {
	var stringValue string
	if err := json.Unmarshal(data, &stringValue); err == nil {
		value.stringValue = &stringValue
		value.intValue = nil
		return nil
	}

	var intValue int
	if err := json.Unmarshal(data, &intValue); err == nil {
		value.stringValue = nil
		value.intValue = &intValue
		return nil
	}

	value.stringValue = nil
	value.intValue = nil
	return nil
}

// KMSContractID is a KMS contract identifier accepted as either string or number.
type KMSContractID = StringOrNumber

// StringKMSContractID creates a string KMS contract ID.
func StringKMSContractID(value string) *KMSContractID {
	return NewStringOrNumberString(value)
}

// IntKMSContractID creates a numeric KMS contract ID.
func IntKMSContractID(value int) *KMSContractID {
	return NewStringOrNumberInt(value)
}

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

// KMSContract represents a KMS contract: a group of equivalent KMS node
// replicas sharing one root key. ContractAddress is an on-chain address for
// ETHEREUM/BASE, or the sentinel "phala" for the off-chain PHALA KMS (where
// ChainID is 0). K256Pubkey / CAPubkey are the verification anchors.
//
// Available from API version 2026-06-23.
type KMSContract struct {
	ID              string  `json:"id"`
	Slug            *string `json:"slug,omitempty"`
	Label           *string `json:"label,omitempty"`
	ContractAddress string  `json:"contract_address"`
	ChainID         int     `json:"chain_id"`
	K256Pubkey      *string `json:"k256_pubkey,omitempty"`
	CAPubkey        *string `json:"ca_pubkey,omitempty"`
	NodeCount       int     `json:"node_count"`
}

// ListKMSContractsResponse is the paginated list of KMS contracts.
type ListKMSContractsResponse = Paginated[KMSContract]

// KMSContractNode represents a single KMS node (replica) under a contract,
// including its RPC URL. Available from API version 2026-06-23.
type KMSContractNode struct {
	ID      string  `json:"id"`
	Slug    *string `json:"slug,omitempty"`
	URL     string  `json:"url"`
	Version string  `json:"version"`
	KMSType string  `json:"kms_type"`
}

// ListKMSContractNodesResponse is the list of nodes under a KMS contract.
type ListKMSContractNodesResponse struct {
	Items []KMSContractNode `json:"items"`
	Total int               `json:"total"`
}

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
