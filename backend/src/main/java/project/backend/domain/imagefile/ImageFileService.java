package project.backend.domain.imagefile;


import com.amazonaws.AmazonServiceException;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.CannedAccessControlList;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;
import java.io.IOException;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import project.backend.global.exception.ex.ImageFileException;
import project.backend.global.exception.errorcode.ImageFileErrorCode;
import software.amazon.awssdk.core.exception.SdkClientException;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImageFileService {

	private final ImageFileRepository imageFileRepository;

	private final AmazonS3 amazonS3;

	@Value("${cloud.aws.s3.bucket}")
	private String bucket;

	@Transactional
	public ImageFile saveImageFile(MultipartFile file, ImageType type) {

		log.info("Saving image file");
		String uploadFileName = file.getOriginalFilename();

		checkFileValidation(uploadFileName);
		checkFileTypeIsImage(file.getContentType());

		String extension = uploadFileName.substring(uploadFileName.lastIndexOf(".")).toLowerCase();

		checkFileExtensionIsImage(extension);

		String storeFileName = UUID.randomUUID() + extension;
		String s3Key = getS3Key(type, storeFileName);

		try {
			// 메타데이터 설정
			ObjectMetadata metadata = new ObjectMetadata();
			metadata.setContentType(file.getContentType());
			metadata.setContentLength(file.getSize());

			// 업로드 실행
			amazonS3.putObject(new PutObjectRequest(bucket, s3Key, file.getInputStream(), metadata));

			ImageFile imageFile = ImageFile.of(storeFileName, uploadFileName, type);
			imageFileRepository.save(imageFile);

			return imageFile;

			// db에 메타데이터 저장
		} catch (IOException | SdkClientException | AmazonServiceException e) {
			log.error("파일 업로드 실패",e);
			throw new ImageFileException(ImageFileErrorCode.FILE_SAVE_FAILURE);
		}

	}

	private String getS3Key(ImageType type, String storeFileName) {
		return switch (type) {
			case PROFILE_IMAGE -> "images/profile/" + storeFileName;
			case CHAT_IMAGE -> "images/chat/" + storeFileName;
			default -> throw new ImageFileException(ImageFileErrorCode.INVALID_ROUTE);
		};
	}

	private void checkFileExtensionIsImage(String extension) {
		List<String> imageExtensions = List.of(".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp");
		if (!imageExtensions.contains(extension)) {
			throw new ImageFileException(ImageFileErrorCode.INVALID_IMAGE_TYPE);
		}
	}

	private void checkFileTypeIsImage(String fileType) {
		if (fileType == null || !fileType.startsWith("image/")) {
			throw new ImageFileException(ImageFileErrorCode.INVALID_IMAGE_TYPE);
		}
	}

	private void checkFileValidation(String fileName) {
		if (fileName == null || !fileName.contains(".")) {
			throw new ImageFileException(ImageFileErrorCode.INVALID_IMAGE_TYPE);
		}
	}

	@Transactional(readOnly = true)
	public ImageFile getProfileImageByStoreFileName(String storeFileName) {
		return imageFileRepository.findByStoreFileName(storeFileName)
			.orElseThrow(() -> new ImageFileException(ImageFileErrorCode.FILE_NOT_FOUND));
	}

	@Transactional(readOnly = true)
	public ImageFile getImageById(Long imageFileId) {
		return imageFileRepository.findById(imageFileId)
			.orElseThrow(() -> new ImageFileException(ImageFileErrorCode.FILE_NOT_FOUND));
	}
}
