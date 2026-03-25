import cv2
import easyocr
import sys

reader = easyocr.Reader(['en'])
cap = cv2.VideoCapture(1)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = reader.readtext(frame)

    for (bbox, text, prob) in results:
        if prob > 0.5:
            clean_text = text.strip().upper()

            if clean_text.startswith("AGV"):
                print(clean_text, flush=True)
                cap.release()
                cv2.destroyAllWindows()
                sys.exit(0)     

            (top_left, top_right, bottom_right, bottom_left) = bbox
            cv2.rectangle(frame, tuple(map(int, top_left)), tuple(map(int, bottom_right)), (0, 255, 0), 2)
            cv2.putText(frame, clean_text, tuple(map(int, top_left)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

    cv2.imshow("Camera Feed", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
sys.exit(0)
