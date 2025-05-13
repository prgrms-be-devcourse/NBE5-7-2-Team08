package project.backend.global.exception.errorcode;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;
import project.backend.global.exception.ErrorResponse;

@Getter
@AllArgsConstructor
public enum ImageFileErrorCode implements ErrorCode {
    FILE_SAVE_FAILURE("IE-001", "이미지 저장 실패", HttpStatus.INTERNAL_SERVER_ERROR),
    FILE_NOT_FOUND("IE-002", "이미지를 찾을 수 없습니다.", HttpStatus.NOT_FOUND),
    INVALID_IMAGE_TYPE("IE-003", "적합하지 않은 파일입니다.", HttpStatus.BAD_REQUEST);


    private final String code;

    private final String message;

    private final HttpStatus status;

}
