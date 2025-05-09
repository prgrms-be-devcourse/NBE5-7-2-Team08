package project.backend.domain.member.api;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import project.backend.domain.member.app.MemberService;
import project.backend.domain.member.dto.MemberResponse;
import project.backend.domain.member.dto.SignUpRequest;

@Slf4j
@RestController
@RequestMapping("/signup")
@RequiredArgsConstructor
public class SignupController {

  private final MemberService memberService;

  @PostMapping
  public MemberResponse signup(@RequestBody SignUpRequest request) {
    log.info("request = {}", request);
    return memberService.saveMember(request);
  }
}
