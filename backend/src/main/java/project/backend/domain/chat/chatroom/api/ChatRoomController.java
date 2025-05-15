package project.backend.domain.chat.chatroom.api;


import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import project.backend.domain.chat.chatroom.app.ChatRoomService;
import project.backend.domain.chat.chatroom.dto.ChatRoomRequest;
import project.backend.domain.chat.chatroom.dto.ChatRoomSimpleResponse;
import project.backend.domain.chat.chatroom.dto.InviteCodeResponse;
import project.backend.domain.chat.chatroom.dto.InviteJoinRequest;
import project.backend.domain.chat.chatroom.dto.InviteJoinResponse;

import java.security.Principal;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import project.backend.domain.chat.chatroom.dto.MyChatRoomResponse;
import project.backend.domain.chat.chatroom.dto.ChatRoomDetailResponse;
import project.backend.domain.chat.chatroom.dto.RecentChatRoomResponse;
import project.backend.domain.member.dto.MemberDetails;
import project.backend.global.exception.errorcode.AuthErrorCode;
import project.backend.global.exception.ex.AuthException;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/chat-rooms")
public class ChatRoomController {

	private final ChatRoomService chatRoomService;

	@PostMapping
	@ResponseBody
	@ResponseStatus(HttpStatus.CREATED)
	public ChatRoomSimpleResponse createChatRoom(@Valid @RequestBody ChatRoomRequest request,
		@AuthenticationPrincipal MemberDetails memberDetails) {
		Long ownerId = memberDetails.getId();

		log.info("채팅방생성");
		return chatRoomService.createChatRoom(request, ownerId);
	}

	@GetMapping("/invite/{roomId}")
	@ResponseBody
	public InviteCodeResponse getInviteUrl(@PathVariable Long roomId,
		@AuthenticationPrincipal MemberDetails memberDetails
	) {

		if (memberDetails == null) {
			throw new AuthException(AuthErrorCode.UNAUTHORIZED_USER);
		}

		Long memberId = memberDetails.getId();
		boolean isParticipant = chatRoomService.isParticipant(roomId, memberId);

		if (!isParticipant) {
			throw new AuthException(AuthErrorCode.FORBIDDEN_PARTICIPANT);
		}

		String inviteCode = chatRoomService.getInviteCode(roomId);

		return new InviteCodeResponse(inviteCode);
	}


	@PostMapping("/join")
	@ResponseStatus(HttpStatus.OK)
	public InviteJoinResponse joinChatRoom(@RequestBody InviteJoinRequest request,
		@AuthenticationPrincipal MemberDetails memberDetails
	) {
		if (memberDetails == null) {
			throw new AuthException(AuthErrorCode.UNAUTHORIZED_USER);
		}

		Long roomId = chatRoomService.joinChatRoom(request.getInviteCode(), memberDetails.getId());
		return new InviteJoinResponse(roomId);
	}


	@GetMapping("/recent")
	public RecentChatRoomResponse getRecentRoomId(Principal principal) {
		Long roomId = chatRoomService.getMostRecentRoomId(principal.getName());
		return new RecentChatRoomResponse(roomId);
	}

	@GetMapping
	public Page<ChatRoomDetailResponse> findAllChatRooms(
		@AuthenticationPrincipal MemberDetails memberDetails,
		@PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
		if (memberDetails == null) {
			throw new AuthException(AuthErrorCode.UNAUTHORIZED_USER);
		}
		Long memberId = memberDetails.getId();
		// 채팅방 목록 리스트로 가져오기
		return chatRoomService.findChatRoomsByParticipantId(memberId, pageable);
	}

  // 자신이 만든 채팅방 가져오기 -> 주후 인증객체 id로 조회가능 할듯(Authentication)
  @GetMapping("/mine/{memberId}")
  public Page<MyChatRoomResponse> findMyAllChatRooms(@PathVariable Long memberId,
                                                     @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
    log.info("자신이 만든 채팅방 요청: memberId = {}", memberId);
    return chatRoomService.findAllRoomsByOwnerId(memberId, pageable);

  }

}
