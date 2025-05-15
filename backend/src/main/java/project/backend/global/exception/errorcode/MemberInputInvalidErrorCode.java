package project.backend.global.exception.errorcode;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum MemberInputInvalidErrorCode implements ErrorCode {
    INVALID_UNKNOWN("MIE-001", "알 수 없는 이유로 유효성 검증에 실패했습니다."),
    INVALID_EMAIL("MIE-002", "이메일 형식이 올바르지 않습니다."),
    INVALID_PASSWORD("MIE-003", "비밀번호는 최소 12자 이상이어야 합니다."),
    INVALID_NICKNAME("MIE-004", "닉네임은 최소 3자 이상이어야 합니다.");

    private final String code;
    private final String message;
    private final HttpStatus status = HttpStatus.BAD_REQUEST;
}
