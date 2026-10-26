import AppKit
import PDFKit
import Vision
let doc = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1]))!
for index in 0..<doc.pageCount {
  let page = doc.page(at: index)!
  let bounds = page.bounds(for: .mediaBox)
  let image = page.thumbnail(of: NSSize(width: bounds.width * 2, height: bounds.height * 2), for: .mediaBox)
  let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)!
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  try! VNImageRequestHandler(cgImage: cgImage).perform([request])
  let lines = (request.results ?? []).sorted { a,b in
    abs(a.boundingBox.midY-b.boundingBox.midY) > 0.008 ? a.boundingBox.midY > b.boundingBox.midY : a.boundingBox.minX < b.boundingBox.minX
  }
  print("=== PAGE \(index + 1) ===")
  for line in lines { if let text=line.topCandidates(1).first?.string { print(text) } }
}
