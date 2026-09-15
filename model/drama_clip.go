package model

type DramaClipOrder struct {
	ID               string `json:"id"`
	ExpectedRevision int64  `json:"expectedRevision"`
}

type DramaShot struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Duration   float64 `json:"duration"`
	Action     string  `json:"action"`
	Dialogue   string  `json:"dialogue"`
	Speaker    string  `json:"speaker"`
	Camera     string  `json:"camera"`
	Sound      string  `json:"sound"`
	EntryState string  `json:"entryState"`
	ExitState  string  `json:"exitState"`
}

type DramaClip struct {
	ID         string      `json:"id" gorm:"primaryKey;size:64"`
	UserID     string      `json:"-" gorm:"index;size:64;not null"`
	ProjectID  string      `json:"projectId" gorm:"index;size:64;not null"`
	EpisodeID  string      `json:"episodeId" gorm:"index;size:64;not null"`
	Title      string      `json:"title"`
	Scene      string      `json:"scene"`
	Position   int         `json:"position"`
	Summary    string      `json:"summary" gorm:"type:text"`
	EntryState string      `json:"entryState" gorm:"type:text"`
	ExitState  string      `json:"exitState" gorm:"type:text"`
	Shots      []DramaShot `json:"shots" gorm:"serializer:json;type:text"`
	Revision   int64       `json:"revision"`
	Archived   bool        `json:"archived" gorm:"not null;default:false"`
	CreatedAt  string      `json:"createdAt"`
	UpdatedAt  string      `json:"updatedAt"`
}
