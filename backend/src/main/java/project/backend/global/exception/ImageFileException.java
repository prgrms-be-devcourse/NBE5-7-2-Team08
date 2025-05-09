package project.backend.global.exception;

import lombok.Getter;
import project.backend.domain.imagefile.ImageFileErrorCode;

@Getter
public class ImageFileException extends RuntimeException {

  private final ImageFileErrorCode errorCode;

  public ImageFileException(ImageFileErrorCode errorCode) {
    super(errorCode.getMessage());
    this.errorCode = errorCode;
  }
}
