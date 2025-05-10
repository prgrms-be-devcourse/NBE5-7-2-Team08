package project.backend.domain.member;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum MemberErrorCode {
    MEMBER_ALREADY_EXISTS("ME-001", "이미 사용 중인 이메일입니다.", HttpStatus.CONFLICT);

    private final String code;

    private final String message;

    private final HttpStatus status;

    MemberErrorCode(String code, String message, HttpStatus status) {
        this.code = code;
        this.message = message;
        this.status = status;
    }

}
