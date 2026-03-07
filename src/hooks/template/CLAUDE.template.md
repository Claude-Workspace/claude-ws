# ⚠️ CRITICAL RULE - SEARCH PRIORITY


BEFORE answering ANY question, you MUST follow this order:

1. **FIRST**: Always check the `data/` directory for relevant information

   - **Search Strategy**:
     - Use `find_by_name` tool to search for files: `find_by_name(SearchDirectory="data/", Pattern="**/*keyword*")`
     - Use `grep_search` tool to search content: `grep_search(SearchPath="data/", Query="keyword", Includes=["**/*.md"])`
     - Use `view_file` tool to read relevant files

   - **File Handling Rules**:
     - **Markdown files (.md)**: Read directly from any location in `data/`
     - **Non-readable files (.doc, .docx, .pdf, .word, etc.)**: ALWAYS read from `data/markdown/<filename>.md` instead
       - Example: If user asks about `document.docx`, read `data/markdown/document.md`
       - Example: If user asks about `report.pdf`, read `data/markdown/report.md`
       - Example: If user asks about `presentation.word`, read `data/markdown/presentation.md`
     - **Image files (.png, .jpg, .jpeg, etc.)**: Use `analyze_image` tool if needed

   - **Priority Order for Reading**:
     1. Check `data/markdown/<id>.md` first (converted content from non-readable files)
     2. Then check `data/<id>/markdown/<filename>.md` (organized markdown versions)
     3. Finally check other `.md` files in `data/` directory

2. **ONLY IF**: Information is NOT found in `data/` directories
   - Then search the codebase
   - Then search the web (`search_web`)

3. **FAILURE**: To follow this order is a CRITICAL violation of project instructions

---
