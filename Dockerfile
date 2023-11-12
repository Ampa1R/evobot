FROM node:20.9.0-slim

ENV USER=evobot

# create evobot user
RUN groupadd -r ${USER} && \
	useradd --create-home --home /home/evobot -r -g ${USER} ${USER}

# set up volume and user
USER ${USER}
WORKDIR /home/evobot

COPY --chown=${USER}:${USER} package*.json ./
RUN npm ci
VOLUME [ "/home/evobot" ]

COPY --chown=${USER}:${USER}  . .

EXPOSE 3000

ENTRYPOINT [ "npm", "run", "prod" ]
