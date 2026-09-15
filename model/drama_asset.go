package model

type DramaAsset struct {
	ID                    string `json:"id" gorm:"primaryKey;size:64"`
	UserID                string `json:"-" gorm:"index;size:64;not null"`
	ProjectID             string `json:"projectId" gorm:"index;size:64;not null"`
	Title                 string `json:"title"`
	Kind                  string `json:"kind"`
	ParentID              string `json:"parentId" gorm:"index;size:64"`
	Description           string `json:"description" gorm:"type:text"`
	AdoptedVersionID      string `json:"adoptedVersionId" gorm:"size:64"`
	DefaultVoiceVersionID string `json:"defaultVoiceVersionId" gorm:"size:64"`
	Revision              int64  `json:"revision"`
	Archived              bool   `json:"archived" gorm:"not null;default:false"`
	CreatedAt             string `json:"createdAt"`
	UpdatedAt             string `json:"updatedAt"`
}

type DramaAssetVersion struct {
	ID        string `json:"id" gorm:"primaryKey;size:64"`
	AssetID   string `json:"assetId" gorm:"index;size:64;not null"`
	StorageID string `json:"storageId" gorm:"index;size:64;not null"`
	MimeType  string `json:"mimeType"`
	Note      string `json:"note" gorm:"type:text"`
	CreatedAt string `json:"createdAt"`
}
