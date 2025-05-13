package project.backend.global.exception.ex;

import lombok.Getter;
import project.backend.global.exception.errorcode.ImageFileErrorCode;

@Getter
public class ImageFileException extends BaseException {

    public ImageFileException(ImageFileErrorCode errorCode) {
        super(errorCode);
    }
}
