package project.backend.domain.member.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
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
	@ResponseStatus(HttpStatus.CREATED)
	public MemberResponse signup(@RequestBody @Valid SignUpRequest request) {
		log.info("request = {}", request);
		return memberService.saveMember(request);
	}

}
