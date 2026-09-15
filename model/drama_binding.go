package model

type DramaBindingReference struct {
	AssetID   string `json:"assetId"`
	VersionID string `json:"versionId"`
	Role      string `json:"role"`
	Order     int    `json:"order"`
	Speaker   string `json:"speaker"`
}
type DramaBinding struct {
	ID         string                  `json:"id" gorm:"primaryKey;size:64"`
	UserID     string                  `json:"-" gorm:"uniqueIndex:drama_binding_stage;size:64"`
	ProjectID  string                  `json:"projectId" gorm:"index;size:64"`
	EpisodeID  string                  `json:"episodeId" gorm:"index;size:64"`
	ClipID     string                  `json:"clipId" gorm:"uniqueIndex:drama_binding_stage;size:64"`
	Stage      string                  `json:"stage" gorm:"uniqueIndex:drama_binding_stage;size:20"`
	References []DramaBindingReference `json:"references" gorm:"serializer:json;type:text"`
	Revision   int64                   `json:"revision"`
	UpdatedAt  string                  `json:"updatedAt"`
}
