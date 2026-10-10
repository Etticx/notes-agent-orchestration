# AI agents

An LLM agent uses a language model to choose actions toward a task.
The application supplies instructions, conversation context, and tool definitions.
The model can request a tool by returning its name and JSON arguments.
Python code validates the request, executes the tool, and sends its result back
to the model. This repeats until the model answers or a step limit is reached.

Memory is stored by the application and supplied as context in later requests.
Saving a conversation does not retrain the language model.

For our project, Python and file tools run locally. Groq provides remote model
inference. Note excerpts included in model requests are sent to Groq.
