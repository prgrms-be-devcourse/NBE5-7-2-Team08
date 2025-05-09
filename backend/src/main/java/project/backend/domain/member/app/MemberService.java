package project.backend.domain.member.app;

import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import project.backend.domain.member.MemberErrorCode;
import project.backend.domain.member.dao.MemberRepository;
import project.backend.domain.member.dto.MemberResponse;
import project.backend.domain.member.dto.SignUpRequest;
import project.backend.domain.member.entity.Member;
import project.backend.domain.member.mapper.MemberMapper;
import project.backend.global.exception.MemberException;

@Service
@RequiredArgsConstructor
public class MemberService {

  private final MemberRepository memberRepository;

  public MemberResponse saveMember(SignUpRequest request) {
    if (checkIfMemberExists(request.getEmail())) {
      throw new MemberException(MemberErrorCode.MEMBER_ALREADY_EXISTS);
    }
    Member newMember = memberRepository.save(MemberMapper.toEntity(request));
    return MemberMapper.toDto(newMember);
  }

  private boolean checkIfMemberExists(String email) {
    return memberRepository.findByEmail(email).isPresent();
  }

  public MemberResponse findMemberByEmail(String email) {
    Member foundMember = memberRepository.findByEmail(email)
        .orElseThrow(() -> new MemberException(MemberErrorCode.MEMBER_NOT_FOUND));

    return MemberMapper.toDto(foundMember);
  }

}
