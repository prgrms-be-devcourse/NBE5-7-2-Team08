package project.backend.domain.member;

import lombok.Getter;
import org.springframework.http.HttpStatus;

public enum MemberErrorCode {
  MEMBER_ALREADY_EXISTS("ME-001", "이미 사용 중인 이메일입니다.", HttpStatus.CONFLICT),
  MEMBER_NOT_FOUND("ME-002", "존재하지 않는 유저입니다.", HttpStatus.NOT_FOUND);


  @Getter
  private final String code;

  @Getter
  private final String message;

  @Getter
  private final HttpStatus status;

  MemberErrorCode(String code, String message, HttpStatus status) {
    this.code = code;
    this.message = message;
    this.status = status;
  }

}
