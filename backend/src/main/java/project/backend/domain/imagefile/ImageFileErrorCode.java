package project.backend.domain.imagefile;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ImageFileErrorCode {
  FILE_SAVE_FAILURE("IE-001", "이미지 저장 실패", HttpStatus.INTERNAL_SERVER_ERROR),
  FILE_NOT_FOUND("IE-002", "이미지를 찾을 수 없습니다.", HttpStatus.NOT_FOUND);


  private final String code;

  private final String message;

  private final HttpStatus status;

  ImageFileErrorCode(String code, String message, HttpStatus status) {
    this.code = code;
    this.message = message;
    this.status = status;
  }
}
