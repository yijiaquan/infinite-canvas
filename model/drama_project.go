package model

type DramaProject struct {
	ID                 string                    `json:"id" gorm:"primaryKey;size:64"`
	UserID             string                    `json:"-" gorm:"index;size:64;not null"`
	Title              string                    `json:"title"`
	SourceType         string                    `json:"sourceType"`
	SourceText         string                    `json:"sourceText" gorm:"type:text"`
	Adaptation         string                    `json:"adaptation" gorm:"type:text"`
	GlobalStyle        string                    `json:"globalStyle" gorm:"type:text"`
	GenerationDefaults map[string]map[string]any `json:"generationDefaults" gorm:"serializer:json;type:text"`
	Revision           int64                     `json:"revision"`
	CreatedAt          string                    `json:"createdAt"`
	UpdatedAt          string                    `json:"updatedAt"`
}

type DramaEpisode struct {
	ID        string `json:"id" gorm:"primaryKey;size:64"`
	UserID    string `json:"-" gorm:"index;size:64;not null"`
	ProjectID string `json:"projectId" gorm:"index;size:64;not null"`
	CanvasID  string `json:"canvasId" gorm:"uniqueIndex;size:64;not null"`
	Title     string `json:"title"`
	Position  int    `json:"position"`
	Script    string `json:"script" gorm:"type:text"`
	Revision  int64  `json:"revision"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}
