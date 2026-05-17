package models

import "time"

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Email        string    `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"not null" json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Event struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `gorm:"index;not null" json:"user_id"`
	Name        string    `gorm:"not null" json:"name"`
	UniqueCode  string    `gorm:"uniqueIndex;not null" json:"unique_code"`
	Status      string    `gorm:"default:draft" json:"status"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	Overlays           []Overlay           `gorm:"foreignKey:EventID" json:"overlays,omitempty"`
	StreamDestinations []StreamDestination `gorm:"foreignKey:EventID" json:"stream_destinations,omitempty"`
}

type Overlay struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	EventID   uint      `gorm:"index;not null" json:"event_id"`
	Type      string    `gorm:"not null" json:"type"`
	Title     string    `json:"title"`
	Content   string    `gorm:"type:text" json:"content"`
	Position  string    `gorm:"default:top-right" json:"position"`
	IsActive  bool      `gorm:"default:false" json:"is_active"`
	Duration  int       `json:"duration"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type StreamDestination struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	EventID   uint      `gorm:"index;not null" json:"event_id"`
	Platform  string    `gorm:"not null" json:"platform"`
	StreamKey string    `gorm:"not null" json:"stream_key"`
	ServerURL string    `json:"server_url"`
	IsActive  bool      `gorm:"default:false" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Session struct {
	ID                  uint   `gorm:"primaryKey" json:"id"`
	EventID             uint   `gorm:"index;not null" json:"event_id"`
	ActiveLayout        string `gorm:"default:single" json:"active_layout"`
	ActiveCameraID      string `json:"active_camera_id"`
	ActiveAudioSourceID string `json:"active_audio_source_id"`
	IsLive              bool   `gorm:"default:false" json:"is_live"`
	ViewerCount         int    `gorm:"default:0" json:"viewer_count"`
}
