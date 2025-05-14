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

	//개발하다보니 사용을 안 하게 됨.
//	@GetMapping("/invite/{inviteCode}")
//	@ResponseBody
//	public InviteCodeResponse getInviteUrl(@PathVariable String inviteCode,
//		@AuthenticationPrincipal MemberDetails memberDetails
//	) {
//
//		if (memberDetails == null) {
//			throw new AuthException(AuthErrorCode.UNAUTHORIZED_USER);
//		}
//
//		Long roomId = chatRoomService.getRoomId(inviteCode);
//		Long memberId = memberDetails.getId();
//		boolean isParticipant = chatRoomService.isParticipant(roomId, memberId);
//
//		if (!isParticipant) {
//			throw new AuthException(AuthErrorCode.FORBIDDEN_PARTICIPANT);
//		}
//
//		String url = "http://localhost:3000/chat/" + inviteCode;
//		return new InviteCodeResponse(url);
//	}




	@PostMapping("/join")
	@ResponseStatus(HttpStatus.OK)
	public InviteJoinResponse joinChatRoom(@RequestBody InviteJoinRequest request,
		@AuthenticationPrincipal MemberDetails memberDetails
	) {
		if (memberDetails == null) {
			throw new AuthException(AuthErrorCode.UNAUTHORIZED_USER);
		}

		return chatRoomService.joinChatRoom(request.getInviteCode(), memberDetails.getId());
	}


	@GetMapping("/recent")
	public RecentChatRoomResponse getRecentRoomId(@AuthenticationPrincipal MemberDetails memberDetails) {
		Long roomId = chatRoomService.getMostRecentRoomId(memberDetails.getEmail());
		String inviteCode = chatRoomService.getInviteCode(roomId);
		return new RecentChatRoomResponse(roomId, inviteCode);
	}

	@GetMapping // URL 매핑 -> 추후 인증객체 id로 조회 예정
	public Page<ChatRoomDetailResponse> findAllChatRooms(@PathVariable Long memberId,
		@PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
		log.info("chatRoom 조회 요청 들어옴: memberId = " + memberId);
		// 채팅방 목록 리스트로 가져오기
		return chatRoomService.findAllByMemberId(memberId, pageable);
	}


}
