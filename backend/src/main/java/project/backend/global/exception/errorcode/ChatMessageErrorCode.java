package project.backend.global.exception.errorcode;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum ChatMessageErrorCode implements ErrorCode {

    INVALID_KEYWORD_LENGTH("CME-001", "검색어는 최소 2자 이상이어야 합니다.",
        HttpStatus.BAD_REQUEST),
    INVALID_ROUTE("CME-002", "유효하지 않은 경로입니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus status;
}
