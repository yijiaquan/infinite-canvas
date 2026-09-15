package service

import (
	"context"
	"errors"
	"github.com/tigerowo/infinite-canvas/repository"
)

func PreflightDeleteStorageObject(ctx context.Context, id string) error {
	user, err := dramaUser(ctx)
	if err != nil {
		return err
	}
	object, err := repository.GetStorageObject(id)
	if err != nil {
		return err
	}
	if object.CreatedBy != user {
		return errors.New("无权删除该对象")
	}
	linked, err := repository.DramaStorageReferenced(id)
	if err != nil {
		return err
	}
	if linked {
		return errors.New("媒体仍被漫剧资产、任务或采用记录引用，不能删除")
	}
	return nil
}
