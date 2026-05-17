package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var db *gorm.DB

func SetDB(database *gorm.DB) {
	db = database
}

// getUserID extracts uint userID from Gin context (set by AuthMiddleware)
func getUserID(c *gin.Context) (uint, bool) {
	val, exists := c.Get("userID")
	if !exists {
		return 0, false
	}
	switch v := val.(type) {
	case uint:
		return v, true
	case float64:
		return uint(v), true
	case int:
		return uint(v), true
	case string:
		parsed, err := strconv.ParseUint(v, 10, 64)
		if err != nil {
			return 0, false
		}
		return uint(parsed), true
	default:
		return 0, false
	}
}

func parseUintParam(c *gin.Context, param string) (uint, bool) {
	parsed, err := strconv.ParseUint(c.Param(param), 10, 64)
	if err != nil {
		return 0, false
	}
	return uint(parsed), true
}

func parseUintQuery(c *gin.Context, param string) (uint, bool) {
	val := c.Query(param)
	if val == "" {
		return 0, false
	}
	parsed, err := strconv.ParseUint(val, 10, 64)
	if err != nil {
		return 0, false
	}
	return uint(parsed), true
}
