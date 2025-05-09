package project.backend.domain.member.mapper;

import project.backend.domain.member.dto.MemberResponse;
import project.backend.domain.member.dto.SignUpRequest;
import project.backend.domain.member.entity.Member;

public class MemberMapper {

  public static Member toEntity(SignUpRequest request) {
    return Member.builder()
        .email(request.getEmail())
        .password(request.getPassword())
        .nickname(request.getNickname())
        .build();
  }

  public static MemberResponse toDto(Member member) {
    return MemberResponse.builder()
        .memberId(member.getId())
        .email(member.getEmail())
        .nickname(member.getNickname())
        .build();
  }
}
