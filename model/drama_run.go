package model

type DramaRunReference struct {
	Title     string `json:"title,omitempty"`
	Speaker   string `json:"speaker,omitempty"`
	StorageID string `json:"storageId"`
	AssetID   string `json:"assetId,omitempty"`
	VersionID string `json:"versionId,omitempty"`
	Role      string `json:"role"`
	Order     int    `json:"order"`
}
type DramaRunSnapshot struct {
	InputMapping []DramaRunInputMapping `json:"inputMapping,omitempty"`
	OutputPrefix string                 `json:"outputPrefix,omitempty"`
	Prompt       string                 `json:"prompt"`
	Model        string                 `json:"model"`
	ChannelID    string                 `json:"channelId"`
	Parameters   map[string]any         `json:"parameters"`
	References   []DramaRunReference    `json:"references"`
}
type DramaRunInputMapping struct {
	ReferenceOrder    int    `json:"referenceOrder"`
	StorageID         string `json:"storageId"`
	Port              string `json:"port"`
	Tag               string `json:"tag"`
	Kind              string `json:"kind"`
	PresentationOrder int    `json:"presentationOrder"`
	Speaker           string `json:"speaker,omitempty"`
}
type DramaRunOutput struct {
	StorageID string `json:"storageId"`
	URL       string `json:"url"`
	MimeType  string `json:"mimeType"`
}
type DramaRun struct {
	ID                 string           `json:"id" gorm:"primaryKey;size:64"`
	UserID             string           `json:"-" gorm:"uniqueIndex:drama_run_request;size:64"`
	RequestID          string           `json:"requestId" gorm:"uniqueIndex:drama_run_request;size:128"`
	ProjectID          string           `json:"projectId" gorm:"index;size:64"`
	EpisodeID          string           `json:"episodeId" gorm:"index;size:64"`
	ClipID             string           `json:"clipId" gorm:"index;size:64"`
	NodeID             string           `json:"nodeId"`
	Kind               string           `json:"kind"`
	Status             string           `json:"status" gorm:"index"`
	UpstreamID         string           `json:"upstreamId"`
	Snapshot           DramaRunSnapshot `json:"snapshot" gorm:"serializer:json;type:text"`
	Outputs            []DramaRunOutput `json:"outputs" gorm:"serializer:json;type:text"`
	Error              string           `json:"error"`
	Credits            int              `json:"credits"`
	CreatedAt          string           `json:"createdAt"`
	UpdatedAt          string           `json:"updatedAt"`
	Body               []byte           `json:"-"`
	ContentType        string           `json:"-"`
	Endpoint           string           `json:"-"`
	Provider           string           `json:"-"`
	ChannelFingerprint string           `json:"-"`
	ConcurrencyKey     string           `json:"-" gorm:"index"`
	ConcurrencyLimit   int              `json:"-"`
	Response           []byte           `json:"-"`
	ResponseType       string           `json:"-"`
}
