package model

type DramaAdoption struct {
	ContentFingerprint string `json:"-" gorm:"size:64"`
	NeedsReview        bool   `json:"needsReview" gorm:"-"`
	ID                 string `json:"id" gorm:"primaryKey;size:64"`
	UserID             string `json:"-" gorm:"uniqueIndex:drama_adoption_role;size:64"`
	ProjectID          string `json:"projectId" gorm:"index;size:64"`
	EpisodeID          string `json:"episodeId" gorm:"index;size:64"`
	ClipID             string `json:"clipId" gorm:"uniqueIndex:drama_adoption_role;size:64"`
	Kind               string `json:"kind" gorm:"uniqueIndex:drama_adoption_role;size:16"`
	RunID              string `json:"runId"`
	StorageID          string `json:"storageId"`
	ClipRevision       int64  `json:"clipRevision"`
	Revision           int64  `json:"revision"`
	UpdatedAt          string `json:"updatedAt"`
}
