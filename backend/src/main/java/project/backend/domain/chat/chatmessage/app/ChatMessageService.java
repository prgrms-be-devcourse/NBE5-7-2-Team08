package project.backend.domain.chat.chatmessage.app;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.domain.chat.chatmessage.dao.ChatMessageRepository;
import project.backend.domain.chat.chatmessage.dto.ChatMessageEditRequest;
import project.backend.domain.chat.chatmessage.dto.ChatMessageRequest;
import project.backend.domain.chat.chatmessage.dto.ChatMessageResponse;
import project.backend.domain.chat.chatmessage.dto.ChatMessageSearchRequest;
import project.backend.domain.chat.chatmessage.dto.ChatMessageSearchResponse;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;
import project.backend.domain.chat.chatmessage.entity.MessageType;
import project.backend.domain.chat.chatmessage.mapper.ChatMessageMapper;
import project.backend.domain.chat.chatroom.app.ChatRoomService;
import project.backend.domain.chat.chatroom.dao.ChatParticipantRepository;
import project.backend.domain.chat.chatroom.dao.ChatRoomRepository;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.imagefile.ImageFile;
import project.backend.domain.imagefile.ImageFileService;
import project.backend.domain.member.app.MemberService;
import project.backend.domain.member.dao.MemberRepository;
import project.backend.domain.member.entity.Member;
import project.backend.global.exception.errorcode.AuthErrorCode;
import project.backend.global.exception.errorcode.ChatMessageErrorCode;
import project.backend.global.exception.ex.AuthException;
import project.backend.global.exception.ex.ChatMessageException;
import project.backend.global.exception.ex.ChatRoomException;
import project.backend.global.exception.ex.MemberException;
import project.backend.global.exception.errorcode.ChatRoomErrorCode;
import project.backend.global.exception.errorcode.MemberErrorCode;

@Service
@RequiredArgsConstructor
public class ChatMessageService {

    private final ChatMessageRepository chatMessageRepository;
    private final ChatRoomService chatRoomService;
    private final MemberService memberService;
    private final ChatParticipantRepository chatParticipantRepository;
    private final ImageFileService imageFileService;

    private final ChatMessageMapper messageMapper;

    @Transactional
    public ChatMessageResponse save(Long roomId, ChatMessageRequest request, String email) {

        Member sender = memberService.getMemberByEmail(email);

        ChatRoom room = chatRoomService.getRoomById(roomId);

        ChatParticipant participant = chatParticipantRepository.findByParticipantAndChatRoom(
                sender, room)
            .orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.NOT_PARTICIPANT));

        ChatMessage message;

        if (request.getType().equals(MessageType.IMAGE) && request.getImageFileId() != null) {
            ImageFile findImage = imageFileService.getImageById(request.getImageFileId());
            message = messageMapper.toEntityWithImage(room, participant, findImage);
        } else if (request.getType().equals(MessageType.TEXT)) {
            message = messageMapper.toEntityWithText(room, participant, request);
        } else if (request.getType().equals(MessageType.CODE)) {
            message = messageMapper.toEntityWithCode(room, participant, request);
        } else {
            throw new ChatMessageException(ChatMessageErrorCode.INVALID_ROUTE);
        }

        chatMessageRepository.save(message);

        return messageMapper.toResponse(message);
    }

    @Transactional(readOnly = true)
    public Page<ChatMessageSearchResponse> searchMessages(Long roomId,
        ChatMessageSearchRequest request) {
        if (request.getKeyword() == null || request.getKeyword().trim().length() < 2) {
            throw new ChatMessageException(ChatMessageErrorCode.INVALID_KEYWORD_LENGTH);
        }
        PageRequest pageable = PageRequest.of(request.getPage(), request.getPageSize());

        Page<ChatMessage> resultPage = chatMessageRepository.searchByKeywordAndRoomId(
            request.getKeyword(),
            roomId,
            pageable
        );
        return resultPage.map(messageMapper::toSearchResponse);
    }

    @Transactional
    public ChatMessageResponse editMessage(Long roomId, ChatMessageEditRequest request,
        String email) {

        memberService.getMemberByEmail(email);
        chatRoomService.getRoomById(roomId);

        ChatMessage message = chatMessageRepository.findById(request.messageId())
            .orElseThrow(() -> new ChatMessageException(ChatMessageErrorCode.MESSAGE_NOT_FOUND));

        if (!message.getSender().getParticipant().getEmail().equals(email)) {
            throw new AuthException(AuthErrorCode.FORBIDDEN_MESSAGE_EDIT);
        }

        message.updateContent(request.content());

        if (message.getType().equals(MessageType.CODE)) {
            message.updateLanguage(request.language());
        }

        ChatMessageResponse response = messageMapper.toResponse(message);
        response.setEdited(true);
        
        return response;
    }
}
